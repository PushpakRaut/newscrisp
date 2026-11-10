"use client";

import dynamic from "next/dynamic";

// The app keeps read history in the browser, so render it on the client only.
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => <div className="state boot">NewsCrisp</div>,
});

export default function ClientApp() {
  return <App />;
}
