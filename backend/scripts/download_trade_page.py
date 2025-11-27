"""CLI script to download the response from capitoltrades trade page"""

from datetime import datetime
from pathlib import Path

from capitolscraper.utils import make_request


def main():
    """Main function for this module"""
    file_path = "tests/resources"
    file_name = f"{datetime.today().strftime('%m-%d-%Y')}_tradepage.txt"

    if Path(f"{file_path}/{file_name}").exists():
        return

    res = make_request("trade")

    with open(f"{file_path}/{file_name}", "w", encoding="utf-8") as file:
        file.write(res.text)


if __name__ == "__main__":
    main()
