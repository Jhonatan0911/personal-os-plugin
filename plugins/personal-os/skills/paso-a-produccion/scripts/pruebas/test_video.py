"""El video del comunicado es entregable: debe existir renderizado, con duración, tamaño y audio (24/11/2026)."""
import shutil, subprocess, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from paquete import revisar_video

REQ = {"min_s": 1, "max_s": 10, "ancho": 320, "alto": 180, "audio": True}


def mp4(ruta, audio=True, seg=2):
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=navy:s=320x180:d={seg}"]
    if audio:
        cmd += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={seg}", "-shortest"]
    subprocess.run(cmd + ["-pix_fmt", "yuv420p", str(ruta)], check=True)
    return ruta


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "requiere ffmpeg")
class VideoTest(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp())

    def test_sin_video_falta(self):
        self.assertTrue(any("falta el video" in m for m in revisar_video([self.d / "video-tutorial.html"], REQ)))

    def test_video_correcto(self):
        self.assertEqual(revisar_video([mp4(self.d / "video-tutorial.mp4")], REQ), [])

    def test_sin_audio(self):
        m = revisar_video([mp4(self.d / "video-tutorial.mp4", audio=False)], REQ)
        self.assertTrue(any("audio" in x for x in m), m)

    def test_muy_corto(self):
        m = revisar_video([mp4(self.d / "video-tutorial.mp4", seg=2)], {**REQ, "min_s": 5})
        self.assertTrue(any("dura" in x for x in m), m)


if __name__ == "__main__":
    unittest.main()
