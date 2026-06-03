import { BrowserRouter, Routes, Route } from "react-router";
import { Navbar } from "./components/Navbar";
import { Workspace } from "./pages/Workspace";
import { Explore } from "./pages/Explore";
import { Billing } from "./pages/Billing";

export function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/billing" element={<Billing />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
