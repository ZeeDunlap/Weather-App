# Weather-App (AtmosAI)
A weather app created using React JS and the Open Weather Map API

Designed by Zee Dunlap and Andrew Foster

The application is designed to allow the user to search for a location and see various weather conditions. These weather conditions include temperature, humidity, wind speed, weather descriptions, and forecast information. This project will give us experience with API integration and data fetching.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Set your OpenWeatherMap API key in the server process environment. In PowerShell:

   ```powershell
   $env:OPENWEATHER_API_KEY = "your-key"
   ```

   Optionally set a five-digit default ZIP code with `$env:DEFAULT_ZIP = "63701"`.
4. Start both the React app and API proxy with `npm run dev`, then open the local URL printed by Vite.

The API key is read only by the Node server and is never placed in browser code. Do not commit credentials or paste them into chat. ZIP searches use US ZIP codes. Weather, geocoding, air-quality, and map requests require an OpenWeatherMap key with access to those endpoints/layers.

Run `npm test` for the Jest test suites and `npm run build` for a production client build.
Run 'npm test -- --coverage' to see the coverage of the tests