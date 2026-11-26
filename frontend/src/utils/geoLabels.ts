/** What the number of a point is called depends on its layer: "Camera no. 09", "Pole no. 12", "Closure no. 5". */
export const numberLabel = (layer: string) =>
  /camera/i.test(layer) ? 'Camera no.' : /pole/i.test(layer) ? 'Pole no.' : /closure|clouser/i.test(layer) ? 'Closure no.' : 'No.';

export const pointTitle = (p: { layer_name: string; point_no: string | null }) =>
  (p.point_no ? `${numberLabel(p.layer_name)} ${p.point_no}` : p.layer_name);
