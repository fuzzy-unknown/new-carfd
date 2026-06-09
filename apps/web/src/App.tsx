import { BrowserRouter, Routes, Route } from "react-router";
import { Navbar } from "./components/Navbar";
import { Workspace } from "./pages/Workspace";
import { Explore } from "./pages/Explore";
import { Billing } from "./pages/Billing";
import { Assets } from "./pages/Assets";

export function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="ml-20 min-h-screen p-6">
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/billing" element={<Billing />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
