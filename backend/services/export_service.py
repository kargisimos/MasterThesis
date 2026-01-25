import csv
import io
from typing import List, Dict, Any

def export_to_csv(data: List[Dict[str, Any]], headers: List[str]) -> str:
    """
    Generic helper to convert a list of dictionaries to a CSV string.
    """
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for row in data:
        filtered_row = {k: v for k, v in row.items() if k in headers}
        writer.writerow(filtered_row)
    return output.getvalue()
