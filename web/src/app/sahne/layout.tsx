import styles from "./layout.module.css";

// The stage is always dark, and runs full-bleed outside the /app shell —
// this is what's projected in the room, not a page in the product.
export default function SahneLayout({ children }: LayoutProps<"/sahne">) {
  return (
    <div data-theme="dark" className={styles.stage}>
      {children}
    </div>
  );
}
