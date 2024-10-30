// Necessary files will be imported here with banner in esbuild

import type { RequestData } from "types/global";

type EdgeRequest = Omit<RequestData, "page">;

export default async function edgeFunctionHandler(
  request: EdgeRequest,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  const routes = globalThis._ROUTES;
  const correspondingRoute = routes.find((route) =>
    route.regex.some((r) => new RegExp(r).test(path)),
  );

  if (!correspondingRoute) {
    throw new Error(`No route found for ${request.url}`);
  }

  const result = await self._ENTRIES[
    `middleware_${correspondingRoute.name}`
  ].default({
    page: correspondingRoute.page,
    request: {
      ...request,
      page: {
        name: correspondingRoute.name,
      },
    },
  });
  await result.waitUntil;
  const response = result.response;
  return response;
}
