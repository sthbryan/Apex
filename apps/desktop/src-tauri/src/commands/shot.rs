use std::path::{Path, PathBuf};

use crate::state::Answer;

type Done = Box<dyn Fn(Answer<()>) + Send + 'static>;

pub async fn take(
    webview: tauri::WebviewWindow,
    bounds: Option<super::browser::Bounds>,
    path: PathBuf,
) -> Answer<()> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let slot = std::sync::Mutex::new(Some(sender));
    let done: Done = Box::new(move |answer| {
        if let Ok(mut held) = slot.lock()
            && let Some(sender) = held.take()
        {
            let _ = sender.send(answer);
        }
    });
    webview
        .with_webview(move |platform| capture(&platform, bounds, path, done))
        .map_err(|error| error.to_string())?;
    receiver.await.map_err(|error| error.to_string())?
}

#[cfg(target_os = "macos")]
#[allow(unsafe_code)]
fn capture(
    platform: &tauri::webview::PlatformWebview,
    bounds: Option<super::browser::Bounds>,
    path: PathBuf,
    done: Done,
) {
    use objc2::MainThreadMarker;
    use objc2::rc::Retained;
    use objc2_app_kit::NSImage;
    use objc2_foundation::NSError;
    use objc2_web_kit::{WKSnapshotConfiguration, WKWebView};

    let inner = platform.inner().cast::<WKWebView>();
    let Some(view) = (unsafe { Retained::retain(inner) }) else {
        done(Err("this pane has no webview".into()));
        return;
    };
    let Some(main) = MainThreadMarker::new() else {
        done(Err("a picture can only be taken on the main thread".into()));
        return;
    };
    let config = unsafe { WKSnapshotConfiguration::new(main) };
    if let Some(area) = bounds {
        unsafe {
            config.setRect(objc2_foundation::NSRect::new(
                objc2_foundation::NSPoint::new(area.x, area.y),
                objc2_foundation::NSSize::new(area.width, area.height),
            ));
        }
    }
    let block = block2::RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
        done(match unsafe { error.as_ref() } {
            Some(failure) => Err(failure.localizedDescription().to_string()),
            None => write_png(image, &path),
        });
    });
    unsafe { view.takeSnapshotWithConfiguration_completionHandler(Some(&config), &block) };
}

#[cfg(target_os = "macos")]
#[allow(unsafe_code)]
fn write_png(image: *mut objc2_app_kit::NSImage, path: &Path) -> Answer<()> {
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep};
    use objc2_foundation::NSDictionary;

    let image = unsafe { image.as_ref() }.ok_or("the webview handed back no picture")?;
    let tiff = image.TIFFRepresentation().ok_or("the picture carried no data")?;
    let rep = NSBitmapImageRep::imageRepWithData(&tiff).ok_or("the picture could not be read")?;
    let props = NSDictionary::new();
    let png = unsafe { rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &props) }
        .ok_or("the picture could not be encoded")?;
    write(path, &png.to_vec())
}

#[cfg(windows)]
#[allow(unsafe_code)]
fn capture(
    platform: &tauri::webview::PlatformWebview,
    _bounds: Option<super::browser::Bounds>,
    path: PathBuf,
    done: Done,
) {
    use webview2_com::CapturePreviewCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG;
    use windows::Win32::System::Com::CreateStreamOnHGlobal;

    let stream = match unsafe { CreateStreamOnHGlobal(None, true) } {
        Ok(stream) => stream,
        Err(error) => {
            done(Err(error.to_string()));
            return;
        }
    };
    let view = match unsafe { platform.controller().CoreWebView2() } {
        Ok(view) => view,
        Err(error) => {
            done(Err(error.to_string()));
            return;
        }
    };
    let target = stream.clone();
    let handler = CapturePreviewCompletedHandler::create(Box::new(move |result| {
        done(result.map_err(|error| error.to_string()).and_then(|()| drain(&target, &path)));
        Ok(())
    }));
    if let Err(error) = unsafe {
        view.CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG, &stream, &handler)
    } {
        tracing::warn!(%error, "the webview refused to take a picture");
    }
}

#[cfg(windows)]
#[allow(unsafe_code)]
fn drain(stream: &windows::Win32::System::Com::IStream, path: &Path) -> Answer<()> {
    use windows::Win32::System::Com::{STATFLAG_NONAME, STATSTG, STREAM_SEEK_SET};

    let mut stat = STATSTG::default();
    unsafe { stream.Stat(&mut stat, STATFLAG_NONAME) }.map_err(|error| error.to_string())?;
    let size = stat.cbSize as usize;
    let mut bytes = vec![0u8; size];
    let mut read = 0u32;
    unsafe { stream.Seek(0, STREAM_SEEK_SET, None) }.map_err(|error| error.to_string())?;
    unsafe { stream.Read(bytes.as_mut_ptr().cast(), size as u32, Some(&mut read)) }
        .ok()
        .map_err(|error| error.to_string())?;
    bytes.truncate(read as usize);
    write(path, &bytes)
}

#[cfg(target_os = "linux")]
fn capture(
    platform: &tauri::webview::PlatformWebview,
    bounds: Option<super::browser::Bounds>,
    path: PathBuf,
    done: Done,
) {
    use gtk::prelude::WidgetExt;
    use webkit2gtk::{SnapshotOptions, SnapshotRegion, WebViewExt};

    let view = platform.inner();
    let scale = f64::from(view.scale_factor().max(1));

    view.snapshot(
        SnapshotRegion::Visible,
        SnapshotOptions::NONE,
        None::<&gtk::gio::Cancellable>,
        move |result| {
            done(match result {
                Ok(surface) => write_surface(&surface, bounds, scale, &path),
                Err(error) => Err(error.to_string()),
            });
        },
    );
}

#[cfg(target_os = "linux")]
fn write_surface(
    surface: &gtk::cairo::Surface,
    bounds: Option<super::browser::Bounds>,
    scale: f64,
    path: &Path,
) -> Answer<()> {
    use gtk::cairo::ImageSurface;

    let image = ImageSurface::try_from(surface.clone())
        .map_err(|_| "the picture could not be read".to_string())?;
    let cut = bounds.and_then(|area| crop(&image, area, scale));
    let mut bytes = Vec::new();
    cut.as_ref().unwrap_or(&image).write_to_png(&mut bytes).map_err(|error| error.to_string())?;
    write(path, &bytes)
}

#[cfg(target_os = "linux")]
fn crop(
    image: &gtk::cairo::ImageSurface,
    area: super::browser::Bounds,
    scale: f64,
) -> Option<gtk::cairo::ImageSurface> {
    use gtk::cairo::{Context, Format, ImageSurface};

    let width = (area.width * scale).round() as i32;
    let height = (area.height * scale).round() as i32;
    if width <= 0 || height <= 0 || width > image.width() || height > image.height() {
        return None;
    }
    let cut = ImageSurface::create(Format::ARgb32, width, height).ok()?;
    let paint = Context::new(&cut).ok()?;
    paint.set_source_surface(image, -area.x * scale, -area.y * scale).ok()?;
    paint.paint().ok()?;
    drop(paint);
    Some(cut)
}

#[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
fn capture(
    _platform: &tauri::webview::PlatformWebview,
    _bounds: Option<super::browser::Bounds>,
    _path: PathBuf,
    done: Done,
) {
    done(Err("this system cannot take a picture of a pane".into()));
}

fn write(path: &Path, bytes: &[u8]) -> Answer<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}
