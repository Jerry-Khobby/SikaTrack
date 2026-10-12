"""SikaTrack backend: the API between the mobile app and the data platform."""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("sikatrack-api")
except PackageNotFoundError:  # running from a source tree that isn't installed
    __version__ = "0.0.0"
