using CapFinLoan.Document.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace CapFinLoan.Document.Infrastructure.Services
{
	public class LocalFileStorageService : IFileStorageService
	{
		private readonly string _basePath;

		public LocalFileStorageService(IConfiguration configuration)
		{
			_basePath = configuration["FileStorage:BasePath"] ?? "Uploads";
		}

		public async Task<string> SaveFileAsync(Stream fileStream, string fileName, string folder)
		{
			var folderPath = Path.Combine(_basePath, folder);
			Directory.CreateDirectory(folderPath);

			var uniqueName = $"{Guid.NewGuid()}_{fileName}";
			var fullPath = Path.Combine(folderPath, uniqueName);

			using var fs = new FileStream(fullPath, FileMode.Create);
			await fileStream.CopyToAsync(fs);

			return fullPath;
		}

		public void DeleteFile(string filePath)
		{
			if (File.Exists(filePath))
				File.Delete(filePath);
		}
	}
}