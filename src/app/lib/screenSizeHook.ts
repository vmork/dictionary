import { useState, useEffect } from "react";


export function useScreenSize() {
  const [screenSize, setScreenSize] = useState<{
    width: number | undefined;
    height: number | undefined;
  }>({
    width: undefined,
    height: undefined
  });

  function handleResize() {
    setScreenSize({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return screenSize;
}
