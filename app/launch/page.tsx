import LaunchForm from "@/components/LaunchForm";

export default function LaunchPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 36, margin: "0 0 8px" }}>
        Launch a <span className="gradient-text">coin</span>
      </h1>
      <p className="muted" style={{ marginBottom: 24, fontSize: 16 }}>
        Upload the art your holders will be able to claim. Holders must own at least the minimum amount of your coin
        in their wallet when they claim.
      </p>
      <LaunchForm />
    </div>
  );
}
