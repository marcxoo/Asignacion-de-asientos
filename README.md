This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Graduación 2026 — Asignación de asientos

- **Link público (invitados):** `/elegir` — Registro (nombre + categoría) y elección de asiento.
- **Panel organizadores:** `/` — Login con contraseña; `/mapa` — Mapa y asignación manual.

## Configuración

1. **Variables de entorno**  
   Copia `.env.example` a `.env.local` y rellena:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Settings → API).
   - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role, solo servidor).
   - Opcional: `ACCESS_PASSWORD` para el login de organizadores.

2. **Migración en Supabase**  
   Crea la tabla `registros` y la columna `registro_id` en `assignments`:
   - **Opción A:** En Supabase → SQL Editor, pega y ejecuta el contenido de `supabase/migrations/20260211000000_registros_y_registro_id.sql`.
   - **Opción B:** Añade en `.env.local` la `DATABASE_URL` (Settings → Database → Connection string URI) y ejecuta:
     ```bash
     npm run db:migrate
     ```

3. **Arrancar**
   ```bash
   npm run dev
   ```
   - Invitados: [http://localhost:3000/elegir](http://localhost:3000/elegir)  
   - Organizadores: [http://localhost:3000](http://localhost:3000) (contraseña) → [http://localhost:3000/mapa](http://localhost:3000/mapa)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
