using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Auth.Application.DTOs;
using CapFinLoan.Auth.Application.Interfaces;
using CapFinLoan.Auth.Domain.Models;
using CapFinLoan.Auth.Infrastructure.Services;
using CapFinLoan.Auth.Persistence.Repositories;

namespace CapFinLoan.Auth.Application.Services
{
	public class AuthService:IAuthService
	{
		private readonly IUserRepository _userRepository;
		private readonly IJwtService _jwtService;
		private readonly IAuthMessagePublisher _messagePublisher;

		public AuthService(
			IUserRepository userRepository,
			IJwtService jwtService,
			IAuthMessagePublisher messagePublisher)
		{
			_userRepository = userRepository;
			_jwtService = jwtService;
			_messagePublisher = messagePublisher;
		}

		public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
		{
			var user = await _userRepository.GetByEmailAsync(dto.Email)
				?? throw new UnauthorizedAccessException("Invalid email or password.");

			if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
				throw new UnauthorizedAccessException("Invalid email or password.");

			if (!user.IsActive)
				throw new UnauthorizedAccessException("Your account has been deactivated.");

			return new AuthResponseDto
			{
				Token = _jwtService.GenerateToken(user),
				Role = user.Role,
				Name = user.Name,
				UserId = user.Id
			};
		}

		public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
		{
			var existing = await _userRepository.GetByEmailAsync(dto.Email);
			if (existing is not null)
				throw new InvalidOperationException("This email is already registered.");

			var user = new User
			{
				Name = dto.Name,
				Email = dto.Email,
				Phone = dto.Phone,
				PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
				Role = "APPLICANT"
			};

			await _userRepository.AddAsync(user);

			await _messagePublisher.PublishUserRegisteredAsync(new AuthUserRegisteredEvent
			{
				UserId = user.Id.ToString(),
				Name = user.Name,
				Email = user.Email,
				Role = user.Role,
				RegisteredAtUtc = DateTime.UtcNow
			});

			return new AuthResponseDto
			{
				Token = _jwtService.GenerateToken(user),
				Role = user.Role,
				Name = user.Name,
				UserId = user.Id
			};
		}
		}
}
