import { renderToString } from "react-dom/server";
import { HomePage } from "./HomePage";
import { NotFoundPage } from "./NotFoundPage";

export function render(notFound: boolean, renderedAt: string): string {
  return renderToString(notFound ? <NotFoundPage /> : <HomePage renderedAt={renderedAt} />);
}
