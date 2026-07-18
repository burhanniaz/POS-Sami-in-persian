import NavRail from "./NavRail.jsx";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-paper p-3">
      <div className="flex gap-3 items-start max-w-[1400px] mx-auto">
        <NavRail />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
