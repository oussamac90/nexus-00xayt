// Cypress plugins configuration v12.0.0
import { on, config } from 'cypress';
import * as webpack from '@cypress/webpack-preprocessor'; // v5.12.0
import * as dotenv from 'dotenv'; // v16.0.0
import * as path from 'path';

/**
 * Main plugin configuration function for Cypress with enhanced environment support
 * @param on - Cypress plugin event handler
 * @param config - Cypress configuration object
 * @returns Modified Cypress configuration with environment-specific settings
 */
const pluginConfig = async (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
): Promise<Cypress.PluginConfigOptions> => {
  // Load environment-specific configuration
  const environment = process.env.TEST_ENVIRONMENT || 'development';
  const envPath = path.resolve(__dirname, `../.env.${environment}`);
  dotenv.config({ path: envPath });

  // Configure TypeScript preprocessing with webpack
  const webpackOptions = {
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: path.resolve(__dirname, '../tsconfig.json'),
                transpileOnly: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
      ],
    },
  };

  const preprocessorOptions = {
    webpackOptions,
    watchOptions: {},
  };

  on('file:preprocessor', webpack(preprocessorOptions));

  // Configure environment-specific settings
  config.env = {
    apiUrl: process.env.API_URL,
    auth0Domain: process.env.AUTH0_DOMAIN,
    auth0ClientId: process.env.AUTH0_CLIENT_ID,
    testEnvironment: environment,
    recordKey: process.env.CYPRESS_RECORD_KEY,
  };

  // Configure viewport settings
  config.viewportWidth = 1280;
  config.viewportHeight = 720;

  // Configure test recording and screenshots
  config.video = true;
  config.screenshotOnRunFailure = true;
  config.chromeWebSecurity = false;

  // Configure timeouts
  config.defaultCommandTimeout = 10000;
  config.requestTimeout = 10000;
  config.responseTimeout = 30000;
  config.pageLoadTimeout = 60000;

  // Configure test retries
  config.retries = {
    runMode: 2,
    openMode: 0,
  };

  // Configure memory management for improved performance
  config.experimentalMemoryManagement = true;
  config.numTestsKeptInMemory = 0;

  // Configure browser launch options
  on('before:browser:launch', (browser, launchOptions) => {
    if (browser.name === 'chrome' && browser.isHeadless) {
      launchOptions.args.push('--disable-gpu');
      launchOptions.args.push('--no-sandbox');
      launchOptions.args.push('--disable-dev-shm-usage');
    }
    return launchOptions;
  });

  // Configure test recording callbacks
  on('after:screenshot', (details) => {
    console.log('Screenshot captured:', details.path);
    return null;
  });

  on('after:spec', (spec, results) => {
    if (results && results.video) {
      console.log('Test recording saved:', results.video);
    }
    return null;
  });

  // Handle test failures
  on('test:after:run', (test, runnable) => {
    if (test.state === 'failed') {
      console.error('Test failed:', test.title);
      console.error('Error:', test.err?.message);
    }
  });

  return config;
};

/**
 * Setup Cypress node events and plugins with enhanced environment support
 * @param on - Cypress plugin event handler
 * @param config - Cypress configuration object
 */
const setupNodeEvents = (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
): void => {
  on('task', {
    log(message: string) {
      console.log(message);
      return null;
    },
    clearDownloads() {
      return null;
    },
  });
};

export = pluginConfig;