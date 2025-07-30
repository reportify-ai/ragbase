import { FileText, FileSpreadsheet, Presentation } from "lucide-react";
import React from "react";

interface FileIconProps {
  ext: string;
}

export function FileIcon({ ext }: FileIconProps) {
  switch (ext) {
    case "pdf":
      return <FileText className="text-red-500 w-5 h-5" />;
    case "docx":
      return <FileText className="text-blue-500 w-5 h-5" />;
    case "xlsx":
      return <FileSpreadsheet className="text-green-500 w-5 h-5" />;
    case "txt":
      return <FileText className="text-gray-500 w-5 h-5" />;
    case "pptx":
      return <Presentation className="text-orange-500 w-5 h-5" />;
    default:
      return <FileText className="text-gray-400 w-5 h-5" />;
  }
}

export default FileIcon; 