import { useEffect, useState } from "react";

function Photo({ blob, className = "", alt = "" }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  if (!url) return <span className={`photo is-empty ${className}`} />;
  return <img className={`photo ${className}`} src={url} alt={alt} draggable="false" />;
}

export default Photo;
