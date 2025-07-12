import type { SVGProps } from "react";

export function PhantasiaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 15.5V18" />
      <path d="M10.5 12C10.5 11.1716 11.1716 10.5 12 10.5C12.8284 10.5 13.5 11.1716 13.5 12C13.5 12.8284 12.8284 13.5 12 13.5C11.1716 13.5 10.5 12.8284 10.5 12Z" />
      <path d="M7 6.5L17 6.5" />
      <path d="M7 6.5C5.61929 6.5 4.5 7.61929 4.5 9L4.5 16C4.5 17.3807 5.61929 18.5 7 18.5L17 18.5C18.3807 18.5 19.5 17.3807 19.5 16L19.5 9C19.5 7.61929 18.3807 6.5 17 6.5" />
    </svg>
  );
}
