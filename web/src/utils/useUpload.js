import * as React from 'react';

function useUpload() {
  const [loading, setLoading] = React.useState(false);
  const upload = React.useCallback(async (input) => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("modus_auth_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let response;

      // Normalize input to handle both { file } and raw File object parameters gracefully
      const isRawFile = typeof window !== "undefined" && input instanceof File;
      const fileToUpload = isRawFile ? input : (input && "file" in input ? input.file : null);

      if (fileToUpload) {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        response = await fetch("/api/upload", {
          method: "POST",
          headers,
          body: formData
        });
      } else if (input && "url" in input) {
        response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers
          },
          body: JSON.stringify({ url: input.url })
        });
      } else if (input && "base64" in input) {
        response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers
          },
          body: JSON.stringify({ base64: input.base64 })
        });
      } else if (input && "buffer" in input) {
        response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            ...headers
          },
          body: input.buffer
        });
      } else {
        throw new Error("Invalid upload input provided");
      }

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("Upload failed: File too large.");
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }
      const data = await response.json();
      return { url: data.url, objectKey: data.objectKey || null, mimeType: data.mimeType || null };
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        return { error: uploadError.message };
      }
      if (typeof uploadError === "string") {
        return { error: uploadError };
      }
      return { error: "Upload failed" };
    } finally {
      setLoading(false);
    }
  }, []);

  return [upload, { loading }];
}

export { useUpload };
export default useUpload;