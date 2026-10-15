import data from './data.json' with { type: 'json' };
import { HOPLA_HOTEL_URL } from './model.js';
import { renderHoplaHotelHome } from './render.js';
export const hoplaHotelData = data;
export const hoplaHotelRooms = [data.room, ...data.rooms];
export const hoplaHotelPages = [
  {
    url: HOPLA_HOTEL_URL,
    title: data.name,
    description: data.description,
    keywords: ['hopla hotel', 'hôtel virtuel', 'salon', 'pixel art', '2009'],
    render: (context) => renderHoplaHotelHome(context, data),
  },
  ...hoplaHotelRooms.map((room) => ({
    url: `${HOPLA_HOTEL_URL}salle/${room.id}`,
    title: `${room.name} — ${data.name}`,
    indexable: false,
    render: (context) => renderHoplaHotelHome(context, data),
  })),
];
