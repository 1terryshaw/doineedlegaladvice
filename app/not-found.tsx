import verticalConfig from "@/lib/vertical.config";
import NotFoundPage from "@/components/pizzazz/NotFoundPage";

export default function NotFound() {
  return <NotFoundPage message={verticalConfig.design.notFoundMessage} />;
}
