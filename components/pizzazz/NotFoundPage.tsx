import Link from 'next/link';

interface NotFoundPageProps {
  message: string;
  homeHref?: string;
  directoryHref?: string;
}

export default function NotFoundPage({
  message,
  homeHref = '/',
  directoryHref = '/directory',
}: NotFoundPageProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 max-w-2xl">
        <span className="text-8xl md:text-9xl font-bold text-gray-200 select-none shrink-0">
          404
        </span>
        <div className="text-center md:text-left">
          <p className="text-xl text-gray-600 mb-6">{message}</p>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            <Link
              href={homeHref}
              className="px-6 py-2.5 bg-[#1E3A5F] text-white rounded-lg font-medium hover:bg-[#2C5282] transition-colors"
            >
              Go Home
            </Link>
            <Link
              href={directoryHref}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Browse Directory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
