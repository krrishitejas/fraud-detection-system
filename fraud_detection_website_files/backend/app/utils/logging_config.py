import logging
import sys


def setup_logging(level: int = logging.INFO) -> None:
    """
    Configures structured console logging without leaking internal
    filesystem paths or system secrets.
    """
    log_format = "%(asctime)s [%(levelname)s] [%(name)s]: %(message)s"
    formatter = logging.Formatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Avoid adding duplicate handlers if already present
    if not root_logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
    else:
        for handler in root_logger.handlers:
            handler.setFormatter(formatter)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
