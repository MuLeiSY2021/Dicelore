import { render } from "@testing-library/react";
import { ICONS } from "./icons.js";

it("每个语义名都映射到可渲染的 SVG 图标", () => {
  for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
    const Icon = ICONS[name];
    const { container, unmount } = render(<Icon />);
    expect(container.querySelector("svg")).not.toBeNull();
    unmount();
  }
});
