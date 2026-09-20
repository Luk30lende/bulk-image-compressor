document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // DOM ELEMENTS
  // ==========================================

  const dropzone = document.getElementById("icDropzone");
  const fileInput = document.getElementById("icFileInput");
  const browseBtn = document.getElementById("icBrowseBtn");
  const actionPanel = document.getElementById("icActionPanel");
  const statusText = document.getElementById("icStatusText");
  const compressBtn = document.getElementById("icCompressBtn");

  // ==========================================
  // CONFIGURATION
  // ==========================================

  const CONFIG = {
    // JPEG/WebP/AVIF quality.
    // 0.8 gives a good balance between quality and size.
    quality: 0.8,

    // Maximum individual file size: 50 MB
    maxFileSize: 50 * 1024 * 1024,

    // Maximum number of images per batch
    maxFiles: 100,

    // Formats we intentionally support
    supportedTypes: new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/gif",
      "image/bmp",
      "image/tiff",
      "image/x-tiff",
    ]),

    // Formats Canvas can normally encode to
    canvasOutputTypes: ["image/webp", "image/jpeg", "image/png"],
  };

  // ==========================================
  // APPLICATION STATE
  // ==========================================

  let filesArray = [];

  // ==========================================
  // FILE INPUT / DROPZONE
  // ==========================================

  browseBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    fileInput.click();
  });

  // Make the entire dropzone clickable
  dropzone.addEventListener("click", (event) => {
    if (event.target === browseBtn || browseBtn.contains(event.target)) {
      return;
    }

    fileInput.click();
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", (event) => {
    // Prevent flickering when moving between child elements
    if (!dropzone.contains(event.relatedTarget)) {
      dropzone.classList.remove("dragover");
    }
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");

    if (event.dataTransfer.files.length) {
      processSelectedFiles(event.dataTransfer.files);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) {
      processSelectedFiles(fileInput.files);
    }

    // Allows selecting the same file again later
    fileInput.value = "";
  });

  // ==========================================
  // FILE VALIDATION
  // ==========================================

  function processSelectedFiles(fileList) {
    const incomingFiles = Array.from(fileList);

    if (!incomingFiles.length) {
      return;
    }

    const validFiles = [];
    const rejectedFiles = [];

    for (const file of incomingFiles) {
      const validation = validateFile(file);

      if (validation.valid) {
        validFiles.push(file);
      } else {
        rejectedFiles.push({
          file,
          reason: validation.reason,
        });
      }
    }

    // Limit the number of files
    if (validFiles.length > CONFIG.maxFiles) {
      const extraFiles = validFiles.splice(CONFIG.maxFiles);

      extraFiles.forEach((file) => {
        rejectedFiles.push({
          file,
          reason: `Maximum of ${CONFIG.maxFiles} images allowed per batch.`,
        });
      });
    }

    // Remove duplicates based on name, size and lastModified
    const uniqueFiles = removeDuplicateFiles(validFiles);

    filesArray = uniqueFiles;

    if (filesArray.length > 0) {
      actionPanel.style.display = "block";

      const rejectedCount = rejectedFiles.length;

      if (rejectedCount > 0) {
        statusText.textContent =
          `${filesArray.length} image(s) selected. ` +
          `${rejectedCount} file(s) skipped.`;
      } else {
        statusText.textContent = `${filesArray.length} image(s) selected. Ready to compress.`;
      }

      console.info("Accepted files:", filesArray);
      console.info("Rejected files:", rejectedFiles);
    } else {
      actionPanel.style.display = "none";

      statusText.textContent = "No supported images were selected.";

      if (rejectedFiles.length) {
        console.warn("Rejected files:", rejectedFiles);
      }
    }
  }

  function validateFile(file) {
    if (!(file instanceof File)) {
      return {
        valid: false,
        reason: "Invalid file.",
      };
    }

    if (file.size === 0) {
      return {
        valid: false,
        reason: "File is empty.",
      };
    }

    if (file.size > CONFIG.maxFileSize) {
      return {
        valid: false,
        reason: "File exceeds the 50 MB size limit.",
      };
    }

    const extension = getFileExtension(file.name);

    const supportedExtensions = [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "avif",
      "gif",
      "bmp",
      "tif",
      "tiff",
    ];

    const typeLooksSupported = CONFIG.supportedTypes.has(file.type);

    const extensionLooksSupported = supportedExtensions.includes(extension);

    // Some browsers provide an empty MIME type for dragged files.
    if (!typeLooksSupported && !extensionLooksSupported) {
      return {
        valid: false,
        reason: "Unsupported image format.",
      };
    }

    return {
      valid: true,
    };
  }

  function getFileExtension(filename) {
    const parts = filename.toLowerCase().split(".");

    if (parts.length < 2) {
      return "";
    }

    return parts.pop();
  }

  function removeDuplicateFiles(files) {
    const seen = new Set();

    return files.filter((file) => {
      const identifier = [file.name, file.size, file.lastModified].join("|");

      if (seen.has(identifier)) {
        return false;
      }

      seen.add(identifier);
      return true;
    });
  }

  // ==========================================
  // IMAGE HELPERS
  // ==========================================

  function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const objectURL = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectURL);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectURL);
        reject(new Error("Browser could not decode this image."));
      };

      img.src = objectURL;
    });
  }

  function createCanvas(width, height) {
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      willReadFrequently: false,
    });

    if (!ctx) {
      throw new Error("Canvas is not supported by this browser.");
    }

    return {
      canvas,
      ctx,
    };
  }

  // ==========================================
  // GIF DETECTION
  // ==========================================

  function isAnimatedGIF(buffer) {
    const bytes = new Uint8Array(buffer);

    // GIF89a / GIF87a
    if (
      bytes.length < 6 ||
      (String.fromCharCode(...bytes.slice(0, 6)) !== "GIF89a" &&
        String.fromCharCode(...bytes.slice(0, 6)) !== "GIF87a")
    ) {
      return false;
    }

    let offset = 6;

    // Logical Screen Descriptor
    if (bytes.length < offset + 7) {
      return false;
    }

    const packed = bytes[offset + 4];

    offset += 7;

    // Global Color Table
    if (packed & 0x80) {
      const colorTableSize = 3 * Math.pow(2, (packed & 0x07) + 1);

      offset += colorTableSize;
    }

    let frameCount = 0;

    while (offset < bytes.length) {
      const introducer = bytes[offset++];

      // Trailer
      if (introducer === 0x3b) {
        break;
      }

      // Image Descriptor
      if (introducer === 0x2c) {
        frameCount++;

        if (frameCount > 1) {
          return true;
        }

        if (offset + 9 > bytes.length) {
          break;
        }

        const imagePacked = bytes[offset + 8];

        offset += 9;

        // Local Color Table
        if (imagePacked & 0x80) {
          const localColorTableSize = 3 * Math.pow(2, (imagePacked & 0x07) + 1);

          offset += localColorTableSize;
        }

        // LZW minimum code size
        offset++;

        // Skip image data sub-blocks
        while (offset < bytes.length) {
          const blockSize = bytes[offset++];

          if (blockSize === 0) {
            break;
          }

          offset += blockSize;
        }

        continue;
      }

      // Extension block
      if (introducer === 0x21) {
        if (offset >= bytes.length) {
          break;
        }

        offset++;

        while (offset < bytes.length) {
          const blockSize = bytes[offset++];

          if (blockSize === 0) {
            break;
          }

          offset += blockSize;
        }

        continue;
      }

      break;
    }

    return false;
  }

  // ==========================================
  // TIFF DECODING
  // ==========================================

  async function decodeTIFF(file) {
    if (typeof UTIF === "undefined") {
      throw new Error("TIFF support requires the UTIF.js library.");
    }

    const buffer = await file.arrayBuffer();

    const ifds = UTIF.decode(buffer);

    if (!ifds || !ifds.length) {
      throw new Error("Could not decode TIFF image.");
    }

    const firstPage = ifds[0];

    UTIF.decodeImage(buffer, firstPage);

    const rgba = UTIF.toRGBA8(firstPage);

    const width = firstPage.width;
    const height = firstPage.height;

    if (!width || !height) {
      throw new Error("Invalid TIFF dimensions.");
    }

    const { canvas, ctx } = createCanvas(width, height);

    const imageData = ctx.createImageData(width, height);

    imageData.data.set(rgba);

    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  // ==========================================
  // CREATE CANVAS FROM FILE
  // ==========================================

  async function fileToCanvas(file) {
    const extension = getFileExtension(file.name);

    const isTIFF =
      file.type === "image/tiff" ||
      file.type === "image/x-tiff" ||
      extension === "tif" ||
      extension === "tiff";

    if (isTIFF) {
      return decodeTIFF(file);
    }

    const buffer = await file.arrayBuffer();

    // Handle animated GIF explicitly
    if (file.type === "image/gif" || extension === "gif") {
      if (isAnimatedGIF(buffer)) {
        throw new Error(
          "Animated GIFs are not compressed because Canvas would remove the animation.",
        );
      }
    }

    const blob = new Blob([buffer], {
      type: file.type || "application/octet-stream",
    });

    const img = await loadImageFromBlob(blob);

    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error("Invalid image dimensions.");
    }

    const { canvas, ctx } = createCanvas(img.naturalWidth, img.naturalHeight);

    // IMPORTANT:
    // Do NOT fill the canvas with white.
    // This preserves PNG transparency.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  // ==========================================
  // CANVAS ENCODING
  // ==========================================

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error(`Browser could not encode image as ${mimeType}.`));

            return;
          }

          resolve(blob);
        },
        mimeType,
        quality,
      );
    });
  }

  // ==========================================
  // FORMAT DETECTION
  // ==========================================

  function hasTransparency(canvas) {
    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!ctx) {
      return false;
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const data = imageData.data;

    // Check alpha channel
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }

    return false;
  }

  function getOutputFormat(file, canvas) {
    const extension = getFileExtension(file.name);

    const isPNG = file.type === "image/png" || extension === "png";

    const isJPEG =
      file.type === "image/jpeg" || extension === "jpg" || extension === "jpeg";

    const isWebP = file.type === "image/webp" || extension === "webp";

    const isAVIF = file.type === "image/avif" || extension === "avif";

    const isGIF = file.type === "image/gif" || extension === "gif";

    const isBMP = file.type === "image/bmp" || extension === "bmp";

    const isTIFF =
      file.type === "image/tiff" ||
      file.type === "image/x-tiff" ||
      extension === "tif" ||
      extension === "tiff";

    const transparency = hasTransparency(canvas);

    /*
     * PNG with transparency:
     * Use WebP if the browser supports WebP encoding.
     */
    if (isPNG && transparency) {
      return {
        mimeType: "image/webp",
        extension: "webp",
      };
    }

    /*
     * WebP stays WebP.
     */
    if (isWebP) {
      return {
        mimeType: "image/webp",
        extension: "webp",
      };
    }

    /*
     * AVIF is decoded by the browser but encoding support
     * isn't guaranteed. We therefore use WebP as the
     * practical compressed output.
     */
    if (isAVIF) {
      return {
        mimeType: "image/webp",
        extension: "webp",
      };
    }

    /*
     * JPEG cannot contain transparency.
     */
    if (isJPEG && transparency) {
      return {
        mimeType: "image/webp",
        extension: "webp",
      };
    }

    /*
     * BMP/TIFF are converted to WebP.
     */
    if (isBMP || isTIFF) {
      return {
        mimeType: "image/webp",
        extension: "webp",
      };
    }

    /*
     * Static GIF:
     * Convert it to WebP rather than pretending the
     * GIF animation can be preserved.
     */
    if (isGIF) {
      return {
        mimeType: "image/webp",
        extension: "webp",
      };
    }

    /*
     * Normal JPEG output.
     */
    return {
      mimeType: "image/jpeg",
      extension: "jpg",
    };
  }

  // ==========================================
  // BROWSER ENCODING SUPPORT
  // ==========================================

  async function supportsEncoding(mimeType) {
    const { canvas } = createCanvas(1, 1);

    try {
      const blob = await canvasToBlob(canvas, mimeType, CONFIG.quality);

      return blob.type === mimeType;
    } catch {
      return false;
    }
  }

  async function getSafeOutputFormat(format) {
    if (await supportsEncoding(format.mimeType)) {
      return format;
    }

    // WebP fallback
    if (format.mimeType !== "image/webp") {
      if (await supportsEncoding("image/webp")) {
        return {
          mimeType: "image/webp",
          extension: "webp",
        };
      }
    }

    // JPEG fallback
    if (await supportsEncoding("image/jpeg")) {
      return {
        mimeType: "image/jpeg",
        extension: "jpg",
      };
    }

    // PNG fallback
    if (await supportsEncoding("image/png")) {
      return {
        mimeType: "image/png",
        extension: "png",
      };
    }

    throw new Error(
      "This browser cannot encode the image into a supported format.",
    );
  }

  // ==========================================
  // FILENAME
  // ==========================================

  function createOutputFilename(originalName, extension) {
    const lastDot = originalName.lastIndexOf(".");

    const baseName =
      lastDot > 0 ? originalName.substring(0, lastDot) : originalName;

    return `${baseName}.${extension}`;
  }

  // ==========================================
  // IMAGE COMPRESSION
  // ==========================================

  async function compressImage(file) {
    const canvas = await fileToCanvas(file);

    const outputFormat = await getSafeOutputFormat(
      getOutputFormat(file, canvas),
    );

    /*
     * PNG output doesn't use quality in the same way
     * as JPEG/WebP.
     */
    const quality =
      outputFormat.mimeType === "image/png" ? undefined : CONFIG.quality;

    let compressedBlob = await canvasToBlob(
      canvas,
      outputFormat.mimeType,
      quality,
    );

    /*
     * If compression somehow made the file larger,
     * keep the original file instead.
     */
    if (compressedBlob.size >= file.size) {
      return {
        name: file.name,
        blob: file,
        originalSize: file.size,
        compressedSize: file.size,
        savedBytes: 0,
        savedPercentage: 0,
        format: file.type || "unknown",
        unchanged: true,
      };
    }

    const finalName = createOutputFilename(file.name, outputFormat.extension);

    const savedBytes = file.size - compressedBlob.size;

    const savedPercentage = (savedBytes / file.size) * 100;

    return {
      name: finalName,
      blob: compressedBlob,
      originalSize: file.size,
      compressedSize: compressedBlob.size,
      savedBytes,
      savedPercentage,
      format: outputFormat.mimeType,
      unchanged: false,
    };
  }

  // ==========================================
  // FORMAT FILE SIZE
  // ==========================================

  function formatBytes(bytes) {
    if (bytes === 0) {
      return "0 Bytes";
    }

    const units = ["Bytes", "KB", "MB", "GB"];

    const index = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${parseFloat(
      (bytes / Math.pow(1024, index)).toFixed(2),
    )} ${units[index]}`;
  }

  // ==========================================
  // BULK COMPRESSION
  // ==========================================

  compressBtn.addEventListener("click", async () => {
    if (!filesArray.length) {
      return;
    }

    compressBtn.disabled = true;

    try {
      const zip = new JSZip();
      const folder = zip.folder("compressed_images");

      let totalOriginalSize = 0;
      let totalCompressedSize = 0;
      let successfulFiles = 0;
      let failedFiles = 0;

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];

        statusText.textContent = `Compressing ${i + 1} of ${filesArray.length}...`;

        try {
          const result = await compressImage(file);

          folder.file(result.name, result.blob);

          totalOriginalSize += result.originalSize;
          totalCompressedSize += result.compressedSize;

          successfulFiles++;
        } catch (error) {
          failedFiles++;

          console.error(`Failed to compress ${file.name}:`, error);
        }
      }

      if (successfulFiles === 0) {
        throw new Error("None of the selected images could be compressed.");
      }

      statusText.textContent = "Creating ZIP file...";

      const zipContent = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6,
          },
        },
        (metadata) => {
          statusText.textContent = `Creating ZIP file... ${Math.round(metadata.percent)}%`;
        },
      );

      const downloadURL = URL.createObjectURL(zipContent);

      const downloadLink = document.createElement("a");

      downloadLink.href = downloadURL;
      downloadLink.download = "compressed_images.zip";

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      /*
       * Delay revocation slightly so the browser
       * has time to start the download.
       */
      setTimeout(() => {
        URL.revokeObjectURL(downloadURL);
      }, 1000);

      const savedBytes = totalOriginalSize - totalCompressedSize;

      const savedPercentage =
        totalOriginalSize > 0 ? (savedBytes / totalOriginalSize) * 100 : 0;

      statusText.textContent =
        `Done! ${successfulFiles} image(s) compressed. ` +
        `Saved ${formatBytes(savedBytes)} ` +
        `(${savedPercentage.toFixed(1)}%).` +
        (failedFiles > 0 ? ` ${failedFiles} file(s) failed.` : "");
    } catch (error) {
      console.error(error);

      statusText.textContent =
        error.message || "An error occurred during compression.";
    } finally {
      compressBtn.disabled = false;
    }
  });
});
