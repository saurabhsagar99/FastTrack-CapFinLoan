using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Application.Domain.Models;
using CapFinLoan.Application.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace CapFinLoan.Application.Persistence.Repositories
{
	public class ApplicationRepository:IApplicationRepository
	{
		private readonly ApplicationDbContext _context;

		public ApplicationRepository(ApplicationDbContext context)
		{
			_context = context;
		}

		public async Task<LoanApplication?> GetByIdAsync(int id)
		{
			return await _context.LoanApplications
				.FirstOrDefaultAsync(a => a.Id == id);
		}

		public async Task<IEnumerable<LoanApplication>> GetByApplicantIdAsync(string applicantId)
		{
			return await _context.LoanApplications
				.Where(a => a.ApplicantId == applicantId)
				.OrderByDescending(a => a.CreatedAt)
				.ToListAsync();
		}

		public async Task<IEnumerable<LoanApplication>> GetAllAsync()
		{
			return await _context.LoanApplications
				.OrderByDescending(a => a.CreatedAt)
				.ToListAsync();
		}

		public async Task<LoanApplication> CreateAsync(LoanApplication application)
		{
			_context.LoanApplications.Add(application);
			await _context.SaveChangesAsync();
			return application;
		}

		public async Task<LoanApplication> UpdateAsync(LoanApplication application)
		{
			application.UpdatedAt = DateTime.UtcNow;
			_context.LoanApplications.Update(application);
			await _context.SaveChangesAsync();
			return application;
		}

		public async Task<bool> ExistsAsync(int id)
		{
			return await _context.LoanApplications.AnyAsync(a => a.Id == id);
		}
	}
}
