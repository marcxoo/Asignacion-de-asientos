import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/mapa',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/elegir',
        destination: '/registro',
        permanent: true,
      },
      {
        source: '/e/:eventId',
        destination: '/evento/:eventId',
        permanent: true,
      },
      {
        source: '/reservar/:id',
        destination: '/delegado/:id',
        permanent: true,
      },
      {
        source: '/i/:token',
        destination: '/invitacion/:token',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
