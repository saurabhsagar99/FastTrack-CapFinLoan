FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY . .
RUN dotnet restore "ApplicationService/CapFinLoan.Application.API/CapFinLoan.Application.API.csproj"
RUN dotnet publish "ApplicationService/CapFinLoan.Application.API/CapFinLoan.Application.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "CapFinLoan.Application.API.dll"]
