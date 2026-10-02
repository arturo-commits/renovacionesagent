import Link from "next/link";

export function Logo({ href = "/inicio", sub = true }: { href?: string; sub?: boolean }) {
  return (
    <Link href={href} className="logo" aria-label="Tuio Academy">
      <span className="logo-word">
        tu<span className="io">io</span>
      </span>
      {sub && <span className="logo-sub">Academy</span>}
    </Link>
  );
}

export function Dots() {
  return (
    <span className="dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}
