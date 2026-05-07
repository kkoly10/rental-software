"use client";

import { useRef, useEffect, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

type Props = {
  name: string;
  onChange: (dataUrl: string | null) => void;
};

export function SignatureCanvasInput({ name, onChange }: Props) {
  const canvasRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  // Keep hidden input in sync whenever the ref changes
  function handleEnd() {
    if (canvasRef.current && !canvasRef.current.isEmpty()) {
      setIsEmpty(false);
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function handleClear() {
    canvasRef.current?.clear();
    setIsEmpty(true);
    onChange(null);
  }

  // Resize canvas to fill its container on mount
  useEffect(() => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = 120;
  }, []);

  return (
    <div>
      <div
        style={{
          border: "1.5px solid var(--border)",
          borderRadius: 10,
          background: "#fafbff",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <SignatureCanvas
          ref={canvasRef}
          penColor="#10233f"
          canvasProps={{
            style: { width: "100%", height: 120, display: "block", touchAction: "none" },
          }}
          onEnd={handleEnd}
        />
        {isEmpty && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              color: "var(--text-soft)",
              fontSize: 13,
            }}
          >
            Draw your signature here
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            fontSize: 12,
            color: "var(--text-soft)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 6px",
          }}
        >
          Clear
        </button>
      </div>
      {/* Hidden input carries the PNG data URL into the form submission */}
      <input type="hidden" name={name} value={isEmpty ? "" : (canvasRef.current?.toDataURL("image/png") ?? "")} />
    </div>
  );
}
