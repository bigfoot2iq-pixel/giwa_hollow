export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
        <p className="text-sm text-muted-blue">
          © {new Date().getFullYear()} Ariwa. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-blue">
            Built on GIWA Sepolia (Chain ID: 91342)
          </p>
          <a
            href="https://x.com/ARIWA_on_Giwa"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ARIWA on X"
            className="text-muted-blue hover:text-[#0062df] transition-colors"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
