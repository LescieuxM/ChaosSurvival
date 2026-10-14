import data from './data.json' with { type: 'json' };
import { HOTEL_URL } from './model.js';
import { renderHotelHome } from './render.js';
export const hotelData = data;
export const hotelRooms = [data.room, ...data.rooms];
export const hotelPages = [
  {
    url: HOTEL_URL,
    title: data.name,
    description: data.description,
    keywords: ['hopla hotel', 'hôtel virtuel', 'salon', 'pixel art', '2009'],
    render: (context) => renderHotelHome(context, data),
  },
  ...hotelRooms.map((room) => ({
    url: `${HOTEL_URL}salle/${room.id}`,
    title: `${room.name} — ${data.name}`,
    indexable: false,
    render: (context) => renderHotelHome(context, data),
  })),
];
