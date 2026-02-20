"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function useMetaColor() {
	const { resolvedTheme } = useTheme();
	const [metaColor, setMetaColorState] = useState<string>("");

	useEffect(() => {
		const color = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";
		setMetaColorState(color);
	}, [resolvedTheme]);

	const setMetaColor = (color: string) => {
		let metaTag = document.querySelector('meta[name="theme-color"]');

		if (!metaTag) {
			metaTag = document.createElement("meta");
			metaTag.setAttribute("name", "theme-color");
			document.head.appendChild(metaTag);
		}

		metaTag.setAttribute("content", color);
		setMetaColorState(color);
	};

	return { metaColor, setMetaColor };
}
