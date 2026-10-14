import data from './data.json' with { type: 'json' };
import { HOTEL_URL } from './model.js';
import { renderHotelHome, renderHotelRoom } from './render.js';
export const hotelData = data;
export const hotelPages = [
  {
    url: HOTEL_URL,
    title: data.name,
    description: data.description,
    keywords: ['hopla hotel', 'hôtel virtuel', 'salon', 'pixel art', '2009'],
    render: (context) => renderHotelHome(context, data),
  },
  {
    url: `${HOTEL_URL}salle/${data.room.id}`,
    title: `${data.room.name} — ${data.name}`,
    indexable: false,
    render: (context) => renderHotelRoom(context, data),
  },
];
