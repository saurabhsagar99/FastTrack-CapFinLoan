using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Document.Application.Interfaces;
using CapFinLoan.Document.Domain.Models;
using CapFinLoan.Document.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Document.Persistence.Repositories
{
	public class DocumentRepository : IDocumentRepository
	{
		private readonly DocumentDbContext _context;

		public DocumentRepository(DocumentDbContext context)
		{
			_context = context;
		}

		public async Task<DocumentEntity> AddAsync(DocumentEntity document)
		{
			_context.Documents.Add(document);
			await _context.SaveChangesAsync();
			return document;
		}

		public async Task<IEnumerable<DocumentEntity>> GetByApplicationIdAsync(int applicationId) =>
			await _context.Documents
				.Where(d => d.ApplicationId == applicationId)
				.ToListAsync();

		public async Task<DocumentEntity?> GetByIdAsync(int id) =>
			await _context.Documents.FindAsync(id);

		public async Task<DocumentEntity?> GetByIdAndUserAsync(int id, string userId) =>
			await _context.Documents
				.FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId);

		public async Task UpdateAsync(DocumentEntity document)
		{
			_context.Documents.Update(document);
			await _context.SaveChangesAsync();
		}

		public async Task DeleteAsync(DocumentEntity document)
		{
			_context.Documents.Remove(document);
			await _context.SaveChangesAsync();
		}
	}
}
