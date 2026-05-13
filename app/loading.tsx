import verticalConfig from "@/lib/vertical.config";
import LoadingSpinner from "@/components/pizzazz/LoadingSpinner";

export default function Loading() {
  return <LoadingSpinner messages={verticalConfig.design.loadingMessages} />;
}
