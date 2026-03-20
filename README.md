# WeatherWear

WeatherWear is a static browser app that fetches a 7-day forecast from Open-Meteo and turns it into daily outfit recommendations.

It includes:

- city search with Open-Meteo geocoding
- browser geolocation
- metric and imperial unit toggles
- light and dark mode
- mobile-friendly forecast cards

## Run it

Open [index.html](./index.html) in a browser.

If you prefer serving it locally:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000).

## Use it on other devices

To open the app on your phone, tablet, or another computer on the same Wi-Fi network:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Then open:

```text
http://YOUR_LOCAL_IP:8000
```

For longer-term sharing, you can also deploy the folder to a static host such as GitHub Pages, Netlify, or Vercel.
