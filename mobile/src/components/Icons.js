import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const base = (size, c, w = 2) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: c,
  strokeWidth: w,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const Pulse = ({ size = 18, color }) => (
  <Svg {...base(size, color)}><Path d="M3 12h4l2-5 4 10 2-5h6" /></Svg>
);
export const Temp = ({ size = 18, color }) => (
  <Svg {...base(size, color)}><Path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" /></Svg>
);
export const Drop = ({ size = 18, color }) => (
  <Svg {...base(size, color)}><Path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" /></Svg>
);
export const Walk = ({ size = 18, color }) => (
  <Svg {...base(size, color)}>
    <Circle cx={13} cy={4.5} r={1.8} />
    <Path d="M9 21l2.5-6 2.5 2v4M8 11l3-3 3 2 3 1M11 8l1.5 7" />
  </Svg>
);
export const Radar = ({ size = 18, color }) => (
  <Svg {...base(size, color)}>
    <Path d="M4 12a8 8 0 0 1 16 0M7.5 12a4.5 4.5 0 0 1 9 0" />
    <Circle cx={12} cy={12} r={1.5} />
  </Svg>
);
export const Back = ({ size = 20, color }) => (
  <Svg {...base(size, color, 2.2)}><Path d="M15 5l-7 7 7 7" /></Svg>
);
export const Chevron = ({ size = 16, color }) => (
  <Svg {...base(size, color, 2.2)}><Path d="M9 5l7 7-7 7" /></Svg>
);
export const Logout = ({ size = 20, color }) => (
  <Svg {...base(size, color)}>
    <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
  </Svg>
);
export const Mail = ({ size = 18, color }) => (
  <Svg {...base(size, color)}>
    <Rect x={3} y={5} width={18} height={14} rx={2} />
    <Path d="M3.5 6.5L12 13l8.5-6.5" />
  </Svg>
);
export const Lock = ({ size = 18, color }) => (
  <Svg {...base(size, color)}>
    <Rect x={5} y={11} width={14} height={9} rx={2} />
    <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const Eye = ({ size = 18, color }) => (
  <Svg {...base(size, color)}>
    <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <Circle cx={12} cy={12} r={3} />
  </Svg>
);
export const EyeOff = ({ size = 18, color }) => (
  <Svg {...base(size, color)}>
    <Path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);
export const Alert = ({ size = 18, color }) => (
  <Svg {...base(size, color)}>
    <Path d="M12 3l9.5 17h-19L12 3z" />
    <Path d="M12 10v4M12 17.5v.01" />
  </Svg>
);
export const Check = ({ size = 18, color }) => (
  <Svg {...base(size, color, 2.2)}><Path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
);
export const Clock = ({ size = 16, color }) => (
  <Svg {...base(size, color)}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </Svg>
);
export const Shield = ({ size = 22, color }) => (
  <Svg {...base(size, color, 2.2)}>
    <Path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z" />
    <Path d="M7.5 12.5h2.2l1.3-2.6 2 5 1.3-2.4h2.2" />
  </Svg>
);

export const Bell = ({ size = 20, color }) => (
  <Svg {...base(size, color)}>
    <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
    <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);
export const BellOff = ({ size = 20, color }) => (
  <Svg {...base(size, color)}>
    <Path d="M3 3l18 18M8.3 5.4A6 6 0 0 1 18 11v4M6 11v5l-1.5 2H17" />
    <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);

const MAP = { pulse: Pulse, temp: Temp, drop: Drop, walk: Walk, radar: Radar };
export const SensorIcon = ({ name, ...p }) => {
  const C = MAP[name] ?? Pulse;
  return <C {...p} />;
};
