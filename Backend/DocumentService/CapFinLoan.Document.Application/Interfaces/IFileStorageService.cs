using System;
using System.Collections.Generic;
using System.Text;

namespace CapFinLoan.Document.Application.Interfaces
{
	public interface IFileStorageService
	{
		Task<string> SaveFileAsync(Stream fileStream, string fileName, string folder);
		void DeleteFile(string filePath);
	}
}
