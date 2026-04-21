import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconDesktop = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export const IconTablet = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M11 18h2" />
  </svg>
);

export const IconMobile = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </svg>
);

export const IconEye = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconDownload = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

export const IconRocket = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M5 15c0-1.5 1-3 2-4L14 4l3 3-7 7c-1 1-2.5 2-4 2z" />
    <path d="M9 15l-2.5 2.5M14 9l-1.5 1.5" />
    <path d="M15 5l4 4" />
    <path d="M5 19c-.5 1-.5 2 0 3 1 .5 2 .5 3 0" />
  </svg>
);

export const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const IconClose = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconPage = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </svg>
);

export const IconQuiz = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-2.9 2-2.9 4M12 17h.01" />
  </svg>
);

export const IconPencil = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const IconLink = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
);

export const IconCart = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
  </svg>
);

export const IconVideo = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <rect x="2" y="5" width="15" height="14" rx="2" />
    <path d="M22 8l-5 4 5 4V8z" />
  </svg>
);

export const IconUpload = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);

export const IconCursor = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M4 4l7 16 2-7 7-2z" />
  </svg>
);

export const IconAlert = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M10.3 3.86a2 2 0 0 1 3.4 0l8.5 14.14a2 2 0 0 1-1.7 3H3.5a2 2 0 0 1-1.7-3z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
