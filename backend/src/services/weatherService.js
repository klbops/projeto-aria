const axios = require('axios');

async function getCurrent() {
  const key = process.env.OPENWEATHER_API_KEY;
  const city = process.env.WEATHER_CITY || 'São Paulo';
  const country = process.env.WEATHER_COUNTRY || 'BR';
  if (!key) return null;

  const { data } = await axios.get(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},${country}&appid=${key}&units=metric&lang=pt_br`
  );
  return {
    temp: Math.round(data.main.temp),
    feels_like: Math.round(data.main.feels_like),
    description: data.weather[0].description,
    humidity: data.main.humidity,
    city: data.name,
    icon: data.weather[0].icon,
  };
}

async function getForecast() {
  const key = process.env.OPENWEATHER_API_KEY;
  const city = process.env.WEATHER_CITY || 'São Paulo';
  const country = process.env.WEATHER_COUNTRY || 'BR';
  if (!key) return null;

  const { data } = await axios.get(
    `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},${country}&appid=${key}&units=metric&lang=pt_br&cnt=8`
  );
  return data.list.map(item => ({
    time: new Date(item.dt * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    temp: Math.round(item.main.temp),
    description: item.weather[0].description,
  }));
}

module.exports = { getCurrent, getForecast };
