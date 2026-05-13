// Load .env from the correct location in both dev and packaged modes
const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

if (app.isPackaged) {
  require('dotenv').config({ path: path.join(process.resourcesPath, '.env') });
} else {
  require('dotenv').config();
}

// Import utilities from lib using tsx/cjs
const coindcx = require('./lib/coindcx.ts');
const binance = require('./lib/binance.ts');
const dbConnect = require('./lib/db.ts').default;
const Config = require('./lib/models/Config.ts').default;
const telegram = require('./lib/telegram.ts');

const isDev = !app.isPackaged;
let mainWindow;

async function setupIpcHandlers() {
  await dbConnect();

  ipcMain.handle('get-assets', async () => {
    return await coindcx.fetchCoinDCXAvailableAssets();
  });

  ipcMain.handle('get-balance', async () => {
    return await coindcx.fetchCoinDCXBalances();
  });

  ipcMain.handle('get-config', async () => {
    try {
      let config = await Config.findOne();
      if (!config) {
        config = await Config.create({
          pairs: [],
          emaPeriod: 15,
          dropThreshold: 1,
          autoOrderEnabled: false,
          telegramEnabled: true,
          desktopNotificationsEnabled: true,
          orderPercentage: 25,
          leverage: 1.0,
          quoteCurrencies: ['USDT'],
          telegramChatId: '',
        });
      }
      return { success: true, config: JSON.parse(JSON.stringify(config.toObject())) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-config', async (event, newConfig) => {
    try {
      // Strip Mongoose internal fields from incoming data
      const { _id, __v, createdAt, updatedAt, ...cleanConfig } = newConfig;
      await Config.findOneAndUpdate(
        {},
        { $set: cleanConfig },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      return { success: true };
    } catch (error) {
      console.error('save-config error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('place-order', async (event, orderParams) => {
    const { asset, quoteCurrency, side, orderType, price, quantity, percentage, leverage } = orderParams;

    let finalQuantity = quantity;
    if (percentage && percentage > 0) {
      const balanceRes = await coindcx.fetchCoinDCXBalances();
      if (!balanceRes.success || !balanceRes.balances) {
        return { success: false, error: 'Failed to fetch balances' };
      }
      const availableBalance = balanceRes.balances[quoteCurrency] || 0;
      let calcPrice = price;
      if (orderType === 'market_order' || !calcPrice) {
        calcPrice = await binance.fetchBinancePrice(`${asset}${quoteCurrency}`);
      }
      if (!calcPrice) return { success: false, error: 'Price not found' };
      const posSize = availableBalance * (percentage / 100) * (leverage || 1);
      finalQuantity = Number((posSize / calcPrice).toFixed(3));
    }

    return await coindcx.placeCoinDCXFuturesOrder(
      asset, quoteCurrency, side, price || 0, finalQuantity, leverage || 1, orderType
    );
  });

  ipcMain.handle('get-positions', async () => {
    return await coindcx.fetchCoinDCXPositions();
  });

  ipcMain.handle('close-position', async (event, { pair, side, quantity, marginCurrency }) => {
    return await coindcx.closeCoinDCXPosition(pair, side, quantity, marginCurrency);
  });

  ipcMain.handle('set-tpsl', async (event, params) => {
    const { pair, side, quantity, leverage, marginCurrency, takeProfitPrice, stopLossPrice } = params;
    return await coindcx.setCoinDCXTpSl(pair, side, quantity, leverage, marginCurrency, takeProfitPrice, stopLossPrice);
  });

  ipcMain.handle('get-price', async (event, symbol) => {
    const price = await binance.fetchBinancePrice(symbol);
    return { success: !!price, price };
  });

  ipcMain.handle('trigger-alert', async (event, { price, ema, pair }) => {
    try {
      const config = await Config.findOne();
      if (!config) return { success: false, error: 'Config not found' };

      const messages = [];
      const baseAsset = pair.replace('USDT', '');
      const quoteCurrencies = config.quoteCurrencies?.length > 0 ? config.quoteCurrencies : ['USDT'];

      if (config.telegramEnabled && config.telegramChatId) {
        const dropPct = (((ema - price) / ema) * 100).toFixed(2);
        const text = `🚨 <b>Price Alert: ${pair}</b>\n\nPrice dropped below EMA!\n\nPrice: ${price}\nEMA: ${ema.toFixed(2)}\nDrop: ${dropPct}%\n\n<i>Order Trailer Bot</i>`;
        await telegram.sendTelegramMessage(config.telegramChatId, text);
        messages.push('Telegram sent.');
      }

      if (config.autoOrderEnabled) {
        const balanceRes = await coindcx.fetchCoinDCXBalances();
        if (balanceRes.success && balanceRes.balances) {
          for (const quote of quoteCurrencies) {
            const bal = balanceRes.balances[quote] || 0;
            if (bal <= 0) continue;

            const targetMarket = `B-${baseAsset}_${quote}`;
            const localPrice = await coindcx.fetchCoinDCXMarketPrice(targetMarket);
            if (!localPrice) continue;

            const posSize = bal * (config.orderPercentage / 100) * config.leverage;
            const qty = Number((posSize / localPrice).toFixed(3));
            if (qty <= 0) continue;

            const orderRes = await coindcx.placeCoinDCXFuturesOrder(baseAsset, quote, 'buy', 0, qty, config.leverage, 'market_order');
            if (orderRes.success) {
              messages.push(`Order placed for ${quote}`);
              if (config.telegramEnabled) {
                await telegram.sendTelegramMessage(config.telegramChatId, `✅ <b>Order Placed (${quote})</b>\n\nAsset: ${baseAsset}\nQty: ${qty}`);
              }
            }
          }
        }
      }

      config.pairs = config.pairs.filter(p => p !== baseAsset);
      await config.save();
      messages.push(`Removed ${baseAsset} from monitoring.`);

      return { success: true, messages };
    } catch (error) {
      console.error('Trigger error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('show-notification', (event, { title, body }) => {
    new Notification({ title, body }).show();
  });
}

function createWindow() {
  console.log('Creating window...');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js'),
    },
  });

  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined') {
    console.log('Loading Vite dev URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL).catch(e => console.error('loadURL failed:', e));
  } else if (typeof MAIN_WINDOW_VITE_NAME !== 'undefined') {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
      .catch(e => console.error('loadFile failed:', e));
  } else {
    // Last resort fallback (should not happen with correct package.json "main" field)
    console.warn('Vite constants not injected — ensure "main" in package.json is ".vite/build/electron-main.js"');
    mainWindow.loadURL('http://localhost:5173').catch(() => mainWindow.loadURL('http://localhost:5174'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  console.log('App is ready, initializing...');
  try {
    await setupIpcHandlers();
    createWindow();
    console.log('Window creation triggered.');
  } catch (error) {
    console.error('Initialization error:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(err => {
  console.error('App whenReady failed:', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
