import LaunchForm from "@/components/LaunchForm";

export default function LaunchPage() {
  return (
    <>
      <h1>Launch a coin</h1>
      <p className="muted">
        Upload the art your holders will be able to claim. Holders must own at least the minimum amount of your coin
        in their wallet when they claim.
      </p>
      <LaunchForm />
    </>
  );
}
