const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Site-relative URL with the deploy base prepended. */
export const url = (path = "/") => `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

/** URL of a file in public/media. */
export const media = (file) => url(`/media/${file}`);

export const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" });
