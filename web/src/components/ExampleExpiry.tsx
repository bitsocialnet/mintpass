import { useEffect, useState } from "react";
import { formatExpiry } from "../expiry";

export function ExampleExpiry({ years, renderedAt }: { years: number; renderedAt: string }) {
  const [date, setDate] = useState(() => formatExpiry(years, renderedAt));
  // Hydrate the build's example first, then refresh it from the visitor's clock.
  useEffect(() => {
    setDate(formatExpiry(years, new Date().toISOString()));
  }, [years]);
  return <dd>{date}</dd>;
}
