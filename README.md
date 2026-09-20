# Bulk Image Compressor

A lightweight, browser-based image compression tool that allows users to compress multiple images at once and download the optimized files as a ZIP archive.

The tool runs entirely in the browser, so images are processed locally without being uploaded to a server.

## Features

- 📁 Drag-and-drop image upload
- 🖼️ Bulk image selection
- 📦 Compress multiple images at once
- 🗜️ Download compressed images as a ZIP file
- 📊 Compression progress and results
- 🔄 Automatic output format selection
- 🌐 Runs entirely in the browser
- 🔒 Images are processed locally for better privacy
- ⚠️ File validation and size limits
- 🖼️ Supports common image formats including:
  - JPEG
  - PNG
  - WebP
  - GIF
  - BMP
  - TIFF
  - AVIF

## How It Works

1. Select or drag images into the upload area.
2. The tool validates the selected files.
3. Images are decoded and drawn onto an HTML Canvas.
4. Images are compressed using browser-based image encoding.
5. Compressed images are added to a ZIP archive.
6. The ZIP file is downloaded to your device.

## Technologies Used

- HTML5
- CSS3
- JavaScript
- Canvas API
- [JSZip](https://stuk.github.io/jszip/)
- [UTIF.js](https://github.com/photopea/UTIF.js)

## Browser Processing

Image compression happens locally in the user's browser using the Canvas API.

No images are sent to an external server during the compression process.

## Limitations

- Animated GIFs are not preserved as animations.
- Multi-page TIFF files currently process only the first page.
- Output format may change depending on the source image and browser capabilities.
- Very large images may require significant browser memory.
- Compression results can vary depending on the original image and format.

## Future Improvements

- Adjustable compression quality
- Image resizing
- Individual image preview
- Before/after file size comparison
- Remove individual files from the queue
- Compression history
- Better mobile experience
- More detailed compression statistics

## License

This project is available for personal and educational use. You may modify and adapt the source code for your own projects.
